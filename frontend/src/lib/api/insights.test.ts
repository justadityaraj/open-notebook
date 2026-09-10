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
        status: mockGet.mock.calls.length > 120 ? 'completed' : 'running',
      },
    }))

    await expect(
      insightsApi.waitForCommand('job-1', { intervalMs: 0 })
    ).resolves.toMatchObject({ status: 'completed' })
    expect(mockGet).toHaveBeenCalledTimes(121)
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

    await expect(polling).resolves.toBeNull()
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('stops polling when the job is unknown', async () => {
    mockGet.mockResolvedValue({ data: { job_id: 'job-1', status: 'unknown' } })

    await expect(
      insightsApi.waitForCommand('job-1', { intervalMs: 0 })
    ).resolves.toMatchObject({ status: 'unknown' })
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('stops after three consecutive status errors', async () => {
    mockGet.mockRejectedValue(new Error('status unavailable'))

    await expect(
      insightsApi.waitForCommand('job-1', { intervalMs: 0 })
    ).resolves.toBeNull()
    expect(mockGet).toHaveBeenCalledTimes(3)
  })
})
