import urllib.request
import urllib.parse
import json
import time
import os

BASE_URL = 'http://127.0.0.1:8000/api'
IMAGE_PATH = r'C:\Users\sivas\Documents\NeuroSeg_AI\data\jpgdataset\Testing\glioma\Te-gl_1.jpg'

def post_multipart_case(url, file_path):
    import mimetypes
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    with open(file_path, 'rb') as f:
        file_data = f.read()
    
    filename = os.path.basename(file_path)
    mimetype = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
    
    body = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f'Content-Type: {mimetype}\r\n\r\n'
    ).encode('utf-8') + file_data + (
        f'\r\n--{boundary}\r\n'
        f'Content-Disposition: form-data; name="label"\r\n\r\n'
        f'Glioma API Test'
        f'\r\n--{boundary}--\r\n'
    ).encode('utf-8')
    
    req = urllib.request.Request(url, data=body, headers={
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    })
    return json.loads(urllib.request.urlopen(req).read().decode('utf-8'))

def post_json(url, data):
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req).read().decode('utf-8'))

def get_json(url):
    return json.loads(urllib.request.urlopen(url).read().decode('utf-8'))

try:
    print('1. Getting models...')
    models = get_json(f'{BASE_URL}/models/')
    classifier = next((m for m in models if m['architecture'] == 'densenet121_classifier'), None)
    if not classifier:
        print('FAIL: Classifier model not found in API')
        exit(1)
    print(f'   Found classifier: {classifier["name"]} (ID: {classifier["id"]})')
    
    print('2. Creating Case & Uploading Asset...')
    case = post_multipart_case(f'{BASE_URL}/cases/', IMAGE_PATH)
    case_id = case['id']
    print(f'   Created case ID: {case_id}')
    
    print('3. Submitting Analysis Job...')
    job = post_json(f'{BASE_URL}/jobs/{case_id}/submit', {
        'model_version_id': classifier['id'],
        'threshold': 0.5
    })
    job_id = job['id']
    print(f'   Submitted job ID: {job_id}')
    
    print('4. Waiting for job completion...')
    for _ in range(15):
        status = get_json(f'{BASE_URL}/jobs/{job_id}')
        if status['status'] == 'completed':
            print('   Job Completed!')
            break
        elif status['status'] == 'failed':
            print(f'   Job Failed: {status.get("error_message")}')
            exit(1)
        time.sleep(1)
    else:
        print('   Job timed out!')
        exit(1)
        
    print('5. Fetching Results...')
    result = get_json(f'{BASE_URL}/jobs/{job_id}/result')
    print('   SUCCESS! Results:')
    print(f'   - Predicted Class: {result.get("predicted_class")}')
    print(f'   - Confidence: {result.get("predicted_confidence")}')
    
except Exception as e:
    import traceback
    print('ERROR:', e)
    traceback.print_exc()
