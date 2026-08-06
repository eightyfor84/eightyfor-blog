# 全局
## 背景
- `--app-bg-primary` 应用的整体背景
- `--app-bg-secondary` 需要分层级的大块背景，稍灰一些（黑的没这么黑、白的没这么白）
- `--component-bg` 组件（悬浮菜单）的背景
- `--component-bg-alt` 悬浮不透明按钮的背景
- `--component-bg-blur` 半透明组件背景，通常需要配合`backdrop-filter: blur`来用
- `--component-bg-blur-alt` 用于悬浮半透明按钮的背景，也需要搭配`backdrop-filter: blur`
- `--component-bg-accent` 悬浮主要按钮的背景，使用主题色的变体
- `--component-bg-accent-blur` 悬浮半透明主要按钮的背景，使用主题色的变体

## 高亮背景
- `--app-bg-primary-hover` 背景是 `--app-bg-primary` 的高亮，用于 `hover`
- `--app-bg-primary-active` 背景是 `--app-bg-primary` 的高亮，用于 `active`
- `--app-bg-secondary-hover` 背景是 `--app-bg-secondary` 的高亮，用于 `hover`
- `--app-bg-secondary-active` 背景是 `--app-bg-secondary` 的高亮，用于 `active`
- `--component-bg-hover` 元素本身透明，但父容器背景是 `component-bg` 系列的高亮，要做深浅色区分，深色下是变亮，浅色是主题色遮罩
- `--component-bg-active`  `--component-bg-hover`的`active`变体
- `--component-bg-accent-hover` 悬浮主要按钮的`hover`高亮
- `--component-bg-accent-active` 悬浮主要按钮的`active`高亮，暂时与`--component-bg-accent-hover`一致


注意：悬浮半透明主要按钮直接用 `filter:brightness(3)` 即可，但悬浮不透明主要按钮有单独的设置规则`--component-bg-accent-hover`

## 前景
- `--app-text-primary` 应用的字体图标颜色
- `--app-text-secondary` 次级的应用字体及图标颜色
- `--component-text-primary` 组件文字，相比`--app-text-primary`稍淡一些
- `--component-text-secondary` 组件次级文字，相比`--app-text-secondary`稍淡一些
- `--component-text-primary-disabled` 组件文字的禁用变体，可以通过`--component-text-primary`改透明度实现
- `--component-text-secondary-disabled` 组件文字的禁用变体，可以通过`--component-text-secondary`改透明度实现

## 高亮前景
- `--component-text-primary-hover` 组件文字的高亮，深色模式使用`--app-text-primary`，浅色模式使用`--accent-color`
- `--component-text-secondary-hover` 组件次级文字的高亮，深色模式使用`--app-text-secondary`，浅色模式使用`--accent-color`的变体
- `--component-text-primary-active` 组件文字的`active`高亮，与`hover`暂时保持一致
- `--component-text-secondary-active` 组件次级文字的`active`高亮，与`hover`暂时保持一致
- `--component-text-accent-hover` 悬浮主要按钮文字的`hover`高亮
- `--component-text-accent-active` 悬浮主要按钮文字的`active`高亮，暂时与`--component-bg-accent-hover`一致


## 基本颜色
- `--accent-color` 主题色，可配置（在配置文件中和主题打包中存储）
- `--accent-color-default` 默认主题色，展示品牌颜色时使用
