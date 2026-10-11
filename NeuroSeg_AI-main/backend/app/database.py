import mongomock
from mongoengine import connect

def init_db():
    connect('neuroseg', host='localhost', mongo_client_class=mongomock.MongoClient)

def get_db():
    yield None
