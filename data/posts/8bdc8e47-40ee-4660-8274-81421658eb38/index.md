---
title: Chronicle of "Chronicle"
date: 2026-02-13T02:52:33.502Z
updatedAt: 2026-08-11T23:21:39.383Z
tags: featured, chronicle
author: Vincent Chen
aiGenerated: false
status: published
font: serif
---

#### 一次社团课 2018

我接触编程不算很早，开始于初中学校社团的 VB 6.0 的课程。那节社团课，看着老社员做的各种小游戏，对编程一窍不通的我，**瞬间对 VB 这个老掉牙的新东西来了兴趣**。

![Visual Basic 6.0 的界面](asset://1770952378568_rn0z_2026-02-13111220.png "Visual Basic 6.0 的界面" =100%x)

可以说，会用“画图”的人，上手 Visual Basic 一般都很快。我的第一行代码不是`hello world`，而是

```vb
Private Sub Command1_Click()
    Label1.Caption = "VB"
End Sub
```

仅仅学会 VB 的组件和赋值表达式，就已经可以做出很多交互，这让我膨胀起来，立志要做一个像 Office 一样的惊天大项目，一遍幻想着在社团课上学会更多的编程技巧，一遍“筹备”着这个梦想中的大项目。

不幸的是，那第一节社团课也是我的最后一节。学校里接触到电脑的时间本就不多（虽然有多媒体，但是学校规定不让碰），微机课随时有上主科的风险，更别说可以连玩两节课90分钟电脑的编程课。自然，报名的同学太多，把我无情地挤出了社团。

#### 一点既视感 2019

[既视感 (Deja Vu) - Wikipedia](link:https://zh.wikipedia.org/wiki/%e6%97%a2%e8%a6%96%e6%84%9f)

> **Inspiration**
> 
> 这个项目也恰好受 [Dejavu Moe](https://blog.dejavu.moe/)'s Blog 的启发。  
> 感谢前辈以及 Papermod 提供的标杆，能支持我在 Chronicle 的开发上不断突破和完善。

一直以来，每次打开音乐软件播放收藏歌单，每放到一首歌，我都能想起**当初收藏它时的地点、人物和我的思绪、心情**。这些歌陪我走过了一个又一个大事件。于是初中时期的我，有一种把这些瞬间想法记录在一个**完全自己制作**的互动作品中的冲动。于是刚学习的 VB 知识自然成为了我的纸笔。

**想要创作的欲望是压抑不住的。**回家之后在老掉牙的笔记本上，我阴差阳错的下到了 Visual Studio 2017，（后来发现里面的 VB 是 VB.NET，其实是 C# 换皮），利用组件的原生特性和赋值表达式，硬生生做出了初代 Chronicle：

![编年史 legacy v1](? "编年史 legacy v1")

（由于当时比较追捧 Windows 的 Metro UI, 做成这种色块扁平风格）

这个幼稚的项目汇集了我对于用户交互和业务逻辑所有的理解。当然，由于缺少对于数据结构和后端逻辑的理解，我的许多想法只能浮于表面：

*为跟上当时的“深色”风潮，我也想做深浅两套 UI ，但是因为不知道**窗口重绘**和**全局变量**，所以要一条一条改，就像*

```vb
Button1.BackColor = Color.White
Button1.ForeColor = Color.Black
Button1.BorderColor = Color.Black
```

这种心血来潮却又眼高手低的体验，让中学时期学业越来越紧张的我感觉有心无力。这个想法搁置了很久很久，直到...

#### 一些新想法 2025

进入大学，我接触到 JavaScript 技术，从此一发不可收拾。在Node、Vue、React 等现代框架，Copilot 等 Coding Agent 的助力下，我的编程效率大大提高，从而可以更加从容地实现我想要的想法。

Notion 一直是我大学常用的笔记软件，但是它的免费版满足不了我各种需求（主要还是高级功能很贵），这让我萌生了自己写一个 markdown 编辑器的想法。在 2025 年暑期的空余时间，我做了 markdown 编辑器的 demo，正想着取什么名字，突然想起中学时期搁置的“编年史”，文档编辑器恰好是它最核心的组件，于是我重新拾起这个项目的名头，把 markdown 编辑器命名为 Chronicle Sonneto（跟 Claude 的模型撞名了），但是碍于学业压力，只做了一部分就搁置了。

2025年末做了一个个人网站 [eightyfor.top](https://eightyfor.top/) （有很多[彩蛋](https://eightyfor.top/lol)），当时并没有做博客的想法，但还是预留了一个Blogs按钮：

![个人主页的博客跳转链接和 Quote 功能](asset://1771125062621_6ewl_Screenshot_2026-02-15-11-10-05-304_com.microsoft.emmx-edit.jpg "Blogs 按钮右边是 Quote 功能，不是随机梗图" =400x)

期末周结束，我心血来潮，打算把暌违数月的 Chronicle 项目做成博客，尽管有很多现成的框架（比如 Hugo），甚至很多现成的博客生成器（Vanblog 等），我还是想自己弄一个完全由自己控制的博客系统，于是这个项目开始更新，从编辑器逻辑和UI重构开始：

![Workdown 编辑器 @ Chronicle v1.1.2](asset://1771126181174_gty6_Screenshot_2026-02-15-11-29-04-944_com.microsoft.emmx-edit.jpg "Workdown 编辑器 @ Chronicle v1.1.2" =100%x)

3.0版本的编辑器[^mspa63uk]

[^mspa63uk]: Workdown 编辑器 @ Chronicle Aurora 3.0：![Workdown 编辑器 @ Chronicle Aurora 3.0](image.png "Workdown 编辑器 @ Chronicle Aurora 3.0" =200x)


再到前后台分开管理和身份验证[^mspa7zqg][^mspa7ymn]：

[^mspa7zqg]: 2.x 网页端设置界面![访问密钥功能 @ Chronicle v2.0](asset://1779975545453_zutn_2026-05-28213853.png "访问密钥功能")

[^mspa7ymn]: 2.x 正式版桌面应用：暂不支持密钥添加 ![访问密钥功能 @ Chronicle v2.0.1 July for Windows](asset://1781160912845_m2rc_2026-06-11145439.png "访问密钥功能 @ Chronicle v2.0.1 July for Windows")

![简单的访问密钥 @ Chronicle v1.1.2](asset://1771126572731_us2x_Screenshot_2026-02-15-11-35-39-020_com.microsoft.emmx-edit.jpg "简单的访问密钥 @ Chronicle v1.1.2" =100%x)


博客 body[^mspa9bia]：

[^mspa9bia]: 2.x 版本及以上的 Chroncle 文章页 ![文章详情 @ Chronicle v2.0](asset://1779975235649_4slw_2026-05-28213253.png)

![文章详情 @ Chronicle v1.1.2](asset://1771132786788_m6dr_Screenshot_2026-02-15-13-19-24-893_com.microsoft.emmx-edit.jpg "文章详情 @ Chronicle v1.1.2" =100%x)


> **Note**
> UI 参照了 iOS 微信的设计，同时融合了一些 Notion 和 Github 的 UI，看着有些“南腔北调”

用了几天时间，Chronicle v1.0 基本完成。\
在这个项目中，我想向世界传达我对于世界具象化、结构化的思考，同时想通过将自己喜欢的 UI 设计体现在我的应用中的方式，建立起我的 UI 品牌和审美理念。

#### 一缕小巧思 2026

实际上，v1.x 的 Chronicle 是一个普通的博客系统，距离我对 Chronicle 寄予的期望总还少了些关键的东西。

当初的一缕巧思，一点灵感，一些触动，往往无法用纸笔和设备记录就匆匆错过，但是心中的执著不想让这些思绪成为永恒的遗憾，于是我想给 Chronicle 赋予“追忆（Recollection）”的功能，这些“追忆”不再受创建和修改时间的约束，能够记录当时的记忆片段、心情，甚至能够调用图片模型生成无法复现的那些场景。可以说，让自己做一个“超梦”，就是“追忆”模块的最终目标。

~~“追忆”模块预计在 v2.0 (预计上线：2026年5月) 上线，敬请期待～~~


#### 2.0上线前的话 - No Re, but Collection

很抱歉，“追忆”模块未能在 Chronicle 2.0 上线。我重新思考了记忆和知识在我们脑海中的存在形态，并尝试以具体的形式来表示抽象的概念，并应用到博客系统中。不过最终我放弃了这个想法。

这的确是一个很值得深入探索的问题，但是自从博客展示端更换架构并与后台解耦之后，划一块空间来实现这种抽象的形式对博客系统这种面向大众的信息媒介几乎没有帮助，这是一个存在于一个人内心深处的东西，只有仔细探索，认真了解，才能堪堪触及灵魂的冰山一角。我或许可以制造一个可视化工具，面向创作者本身，让他们的思维链环与屏幕上的图形建立深刻的链接，并从中获得新知，但这不是 Chronicle 的根本使命。

最后我计划将这一部分独立出来，作为追忆功能的精神延续。我给它命名为 SynaX。名字取自Synapse（突触），意为思维链接，同时能像神经网络一样学习迭代；X 更有交叉（Cross）之意。SynaX既是面向用户的（“追忆”的核心目标），也是面向在看的大众的（对外展示层）。未来对外展示层的部分有可能会作为模板和 CMS 的可选功能加回 Chronicle，以弥补这一遗憾。

取而代之地，我引入了合集（Collection）功能。Chronicle 不能只靠标签来分类文章，也不能只靠全部文章页和搜索页来实现导航。对于技术类文档等高度依赖分类模式的文档，建立一个树状结构的文档合集再合适不过。

合集可以设置封面，在对应的合集页，封面图还会全屏：

![带有全屏封面图的合集页面](asset://1781162987660_r001_2026-06-11152932.png "带有全屏封面图的合集页面" =100%x)

我既希望提供一个优雅的解决方案来改善我们现有的工具，也希望通过创造新功能来改变世界。但实际上，很少有人能够兼顾两者，2.0 的功能取舍也说明了这一点。既有独善之心，又有济世之志，则需仰望星空，同时脚踏实地，方能成事。


#### Aurora 上线后
Chronicle Aurora是一个去繁就简的工程，在2.x版本的迭代中，我非常痛苦地发现：VPS部署本身非常繁琐，各种通信链路也要仔细斟酌。

但自从Aurora去掉云端编辑能力后，编辑变简单了许多。我重构了`data/`结构，让CMS和本地文件直接修改的效果相同，并且将云端能力托管给静态站托管平台如Github Pages，Cloudflare Pages等等，直接省去了很多烦恼，旧版几乎可以退役，也让我从多版本并行的维护中腾出时间精力，专注项目结构本身。

这是一个长远考虑的决定，Aurora是Chronicle真正的未来。

现在Aurora已经在github上线： 
[Chronicle Aurora](link:https://github.com/vanvanhasnophi/chronicle-aurora)

初心不改，极光绚烂。

各位，祝好。