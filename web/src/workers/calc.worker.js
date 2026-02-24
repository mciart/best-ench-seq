/**
 * 计算 Web Worker
 * 在后台线程运行枚举搜索，避免阻塞 UI
 */
import { calculateFromPool } from '@core/calculator.js'

self.onmessage = function (e) {
    const { type, payload } = e.data
    if (type === 'calculate') {
        try {
            const result = calculateFromPool(payload)
            self.postMessage({ type: 'result', payload: result })
        } catch (err) {
            self.postMessage({ type: 'error', payload: err.message })
        }
    }
}
