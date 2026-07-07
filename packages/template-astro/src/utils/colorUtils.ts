/**
 * 将十六进制颜色转换为 RGB 字符串 (不包含 rgba())
 * @param hex 十六进制颜色值，如 "#ff0000" 或 "#f00"
 * @returns RGB 字符串，如 "255, 0, 0"
 */
export function hexToRgbString(hex: string): string {
  try {
    // 移除 # 符号
    const cleanHex = hex.replace('#', '');

    // 处理缩写格式 (#rgb)
    let r: number, g: number, b: number;
    if (cleanHex.length === 3) {
      r = parseInt(cleanHex[0] + cleanHex[0], 16);
      g = parseInt(cleanHex[1] + cleanHex[1], 16);
      b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else if (cleanHex.length === 6) {
      r = parseInt(cleanHex.substring(0, 2), 16);
      g = parseInt(cleanHex.substring(2, 4), 16);
      b = parseInt(cleanHex.substring(4, 6), 16);
    } else {
      return '0, 0, 0';
    }

    return `${r}, ${g}, ${b}`;
  } catch (e) {
    return '0, 0, 0';
  }
}

/**
 * 将十六进制颜色变暗
 * @param hex 十六进制颜色值
 * @param factor 变暗因子 (0-1)，默认 0.86
 * @returns RGB 字符串
 */
export function darkenHex(hex: string, factor: number = 0.86): string {
  try {
    const rgb = hexToRgbString(hex);
    const [r, g, b] = rgb.split(',').map(v => parseInt(v.trim()));

    const rr = Math.max(0, Math.min(255, Math.round(r * factor)));
    const gg = Math.max(0, Math.min(255, Math.round(g * factor)));
    const bb = Math.max(0, Math.min(255, Math.round(b * factor)));

    return `rgb(${rr}, ${gg}, ${bb})`;
  } catch (e) {
    return hex;
  }
}
