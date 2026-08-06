// 简单防抖函数
type Fn = (...args: any[]) => void;
export function debounce(fn: Fn, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function(this: any, ...args: any[]) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}
