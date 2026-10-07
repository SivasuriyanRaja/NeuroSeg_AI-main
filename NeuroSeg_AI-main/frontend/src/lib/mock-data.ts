export type Status = "Completed" | "Running" | "Queued" | "Failed";

export const metrics = {
  totalCases: 248,
  completed: 231,
  running: 6,
  failed: 11,
};

export const activeModel = {
  name: "DenseNet121 Tumor Classifier",
  version: "v2.4.1",
  architecture: "DenseNet-121 + U-Net decoder",
  threshold: 0.5,
  params: "8.06M",
};

export const cases = [
  { id: "C-1042", label: "Patient_001_T1.jpg", date: "2026-10-06 11:42", model: "DenseNet121 v2.4", status: "Completed" as Status, cls: "Glioma", conf: 0.94 },
  { id: "C-1041", label: "Patient_002_FLAIR.png", date: "2026-10-06 10:18", model: "UNet++ v1.9", status: "Running" as Status, cls: "—", conf: 0 },
  { id: "C-1040", label: "Patient_003_T2.jpg", date: "2026-10-05 17:05", model: "DenseNet121 v2.4", status: "Completed" as Status, cls: "Meningioma", conf: 0.88 },
  { id: "C-1039", label: "Patient_004_T1c.png", date: "2026-10-05 14:51", model: "SwinUNETR v0.7", status: "Queued" as Status, cls: "—", conf: 0 },
  { id: "C-1038", label: "Patient_005_T1.jpg", date: "2026-10-04 09:33", model: "DenseNet121 v2.4", status: "Failed" as Status, cls: "—", conf: 0 },
  { id: "C-1037", label: "Patient_006_FLAIR.png", date: "2026-10-03 16:12", model: "UNet++ v1.9", status: "Completed" as Status, cls: "Pituitary", conf: 0.91 },
  { id: "C-1036", label: "Patient_007_T2.jpg", date: "2026-10-03 08:47", model: "DenseNet121 v2.4", status: "Completed" as Status, cls: "No Tumor", conf: 0.97 },
  { id: "C-1035", label: "Patient_008_T1c.png", date: "2026-10-02 13:20", model: "SwinUNETR v0.7", status: "Completed" as Status, cls: "Glioma", conf: 0.86 },
];

export const experiments = [
  { run: "exp-042-densenet-aug", arch: "DenseNet-121", dataset: "BraTS 2021", epochs: 120, dice: 0.942, iou: 0.891, mem: 6120, lat: 38 },
  { run: "exp-041-unetpp-base", arch: "UNet++", dataset: "BraTS 2021", epochs: 100, dice: 0.918, iou: 0.862, mem: 5480, lat: 44 },
  { run: "exp-040-swin-unetr", arch: "SwinUNETR", dataset: "BraTS 2021", epochs: 150, dice: 0.951, iou: 0.904, mem: 11240, lat: 92 },
  { run: "exp-039-resunet-lr3e4", arch: "ResUNet-34", dataset: "Figshare MRI", epochs: 80, dice: 0.887, iou: 0.821, mem: 4210, lat: 29 },
  { run: "exp-038-attn-unet", arch: "Attention U-Net", dataset: "Figshare MRI", epochs: 90, dice: 0.903, iou: 0.844, mem: 4890, lat: 35 },
  { run: "exp-037-effnet-b3", arch: "EfficientNet-B3", dataset: "Kaggle BTMRI", epochs: 60, dice: 0.861, iou: 0.784, mem: 3560, lat: 24 },
  { run: "exp-036-mobilenet-v3", arch: "MobileNetV3", dataset: "Kaggle BTMRI", epochs: 60, dice: 0.812, iou: 0.731, mem: 1980, lat: 11 },
];
