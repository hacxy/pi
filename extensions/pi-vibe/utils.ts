/**
 * 工具函数模块
 *
 * 提供通用的工具函数
 */

/**
 * 随机选择数组中的一个元素
 * @param arr 数组
 * @returns 随机选中的元素
 */
export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * 生成 [min, max] 范围内的随机整数
 * @param min 最小值（包含）
 * @param max 最大值（包含）
 * @returns 随机整数
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
