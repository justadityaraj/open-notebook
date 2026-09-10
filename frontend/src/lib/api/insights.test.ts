import { beforeEach, describe, expect, it, vi } from 'vitest'
import apiClient from './client'
import { insightsApi } from './insights'

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
  },
}))

const mockGet = vi.mocked(apiClient.get)

describe('insightsApi.waitForCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps polling while a command remains pending', async () => {
    mockGet.mockImplementation(async () => ({
      data: {
        job_id: 'job-1',
        status: mockGet.mock.calls.length > 60 ? 'completed' : 'running',
      },
    }))

    await expect(
      insightsApi.waitForCommand('job-1', { intervalMs: 0 })
    ).resolves.toBe(true)
    expect(mockGet).toHaveBeenCalledTimes(61)
  })

  it('stops polling when aborted', async () => {
    const controller = new AbortController()
    mockGet.mockResolvedValue({ data: { job_id: 'job-1', status: 'running' } })

    const polling = insightsApi.waitForCommand('job-1', {
      intervalMs: 60_000,
      signal: controller.signal,
    })
    await vi.waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1))

    controller.abort()

    await expect(polling).resolves.toBe(false)
    expect(mockGet).toHaveBeenCalledTimes(1)
  })
})
