# A4 官方参考资料核对（v0.2）

核对日期：2026-10-02。研究目标仍为 Audi A4 B9 中期改款、欧洲标准轴距三厢版；不包含 A4L、Avant、S4。

## 结论

已冻结 **1 份官方尺寸 PDF、其整页查看 PNG、6 张同代外观照片、1 张 2019 内饰照片**。这些足以开展尺寸约束和形态对照，但**不足以声称“2019 同配置整车参考已齐备”**。本轮没有改变 v0.1 车模曲面，也未导入现成三维模型。

主参考的图内日期为 04/19；它没有写明完整动力与外观套件。2022 发布的照片不能自动认定为 2019 同配置，更不能仅凭发布日期认定生产年款。现阶段应冻结资料身份与用途，而不是虚构一套已核定的选装清单。

## 1. 尺寸与车型身份

- [Audi 官方 A4 尺寸 PDF](https://www.audi-mediacenter.com/en/publications/dimensions/dimensions-a4-1391/download)：图内 04/19，空载、毫米单位。
- 尺寸：长 4762、宽 1847、高 1428、轴距 2820；前后悬 899 / 1043、前后轮距 1572 / 1555、含镜宽 2022。
- 图注写明包含天线时车高增加 3 mm。因此媒体设计说明中的 1431 mm 与这里的 1428 mm 不能直接视为矛盾。
- [2019 官方专题](https://www.audi.com/en/the-audi-a4-major-upgrade-for-the-bestseller-2019-11884)发布于 2019-07-17；[设计说明](https://www.audi.com/en/the-audi-a4-major-upgrade-for-the-bestseller-2019-11884/the-design-11889)区分 basic、advanced、S line 外观，灯具也有不同版本。当前网页归档/更新日期不等于车型首发日期。
- 官方 PDF SHA-256：`4f733bff3c350f1a86aeb9f3e38a617d24cce9bc2275d0b4c9f73b70d451a429`。

## 2. 官方照片清单

[官方 A4 Sedan 图库](https://www.audi.com/en/photos/album/audi-a4-sedan-until-2024-1439)本次可见 13 条：9 张 2022 外观、1 张 2019 多车型合照、3 张 2019 内饰。选择如下 7 张，而不是抓取整个媒体库。

| 素材编号 | 页面发布日期 | 用途 | 官方单张页面 |
|---|---|---|---|
| A226712 | 2022-11-29 | 湖畔前侧，气氛与整体形态辅助 | [来源](https://www.audi.com/en/photos/detail/audi-a4-sedan-from-2019-to-2024-114018) |
| A226704 | 2022-11-29 | 停机坪前侧，车头结构辅助 | [来源](https://www.audi.com/en/photos/detail/audi-a4-sedan-from-2019-to-2024-114010) |
| A226705 | 2022-11-29 | 近侧视，仍有透视，不作正交测量图 | [来源](https://www.audi.com/en/photos/detail/audi-a4-sedan-from-2019-to-2024-114011) |
| A226706 | 2022-11-29 | 后侧，尾部与立柱辅助 | [来源](https://www.audi.com/en/photos/detail/audi-a4-sedan-from-2019-to-2024-114012) |
| A226709 | 2022-11-29 | 近正前，格栅与灯组辅助 | [来源](https://www.audi.com/en/photos/detail/audi-a4-sedan-from-2019-to-2024-114015) |
| A226710 | 2022-11-29 | 近正后，尾灯与饰条辅助 | [来源](https://www.audi.com/en/photos/detail/audi-a4-sedan-from-2019-to-2024-114016) |
| A195684 | 2019-05-15 | 驾驶舱布局，不用于外壳测量 | [来源](https://www.audi.com/en/photos/detail/audi-a4-sedan-from-2019-to-2024-77769) |

外观图片均为绿色 A4，官方文字标注 District Green Metallic。目视可见黑色四环、蜂窝格栅、双臂轮辐、红色卡钳和翼子板徽标。**将它们归为黑化 / S line 风格是观察推断，不等于官方完整配置认证**；动力、轮胎规格和具体生产年款未核定。不直接把这些局部外观套到尺寸图基准上。

已检查 7 张下载图的真实画面。保留官方 1440 px 网页版原文件，不用生成式补图、去水印或超分辨率来增加“证据”。界面缩略图会裁切显示，详情弹窗保留完整图像。

## 3. 本地文件与可追溯性

```text
public/references/audi-a4-dimensions.pdf
public/references/audi-a4-dimensions.png
public/references/2022/A2267xx_web_1440.jpeg
public/references/2019/A195684_web_1440.jpg
public/references/manifest.json
src/data/references.ts
```

`manifest.json` 记录源页面、官方静态资源 URL、原始日期/说明、相对路径、字节数和 SHA-256。原文件下载后重新计算哈希一致。查看 PNG 为原 PDF 的整页栅格化；四视裁切仅在浏览器画布显示时执行，原始参考文件没有被重绘。

照片页面标注 © AUDI AG，并列出 “Use for editorial purposes free of charge”。此说明不能自动扩张为任意商业用途、车模衍生物或素材再分发授权。本项目仅作本地研究，未对外部署；公开发布前需另行核对适用条款。

## 4. 尚缺什么

1. 同一实际车辆、同一完整外观配置的 2019 外观多角度资料。
2. 外观套件、轮毂/轮胎、悬架高度与灯具版本的逐项核定。
3. 曲面截面、曲率、灯腔深度、车漆测量值；公开照片不能唯一恢复这些量。
4. 图纸与透视照片之间的相机标定。当前照片库只是人工参考，不是自动多视图重建。

没有这些数据时，可继续修正通用大形；套件相关的保险杠、轮毂和灯腔应推迟到配置确认后，或明确标为估算。
