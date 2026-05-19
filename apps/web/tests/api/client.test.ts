// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/api/api-error.js';
import { projectsApi } from '../../src/api/client.js';

describe('API client (T-070)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('GET /api/projects returns body on 200', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          projects: [
            { project_id: 1, name: 'P', description: '', created_at: '2026-05-19T00:00:00Z' },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const res = await projectsApi.list();
    expect(res.projects).toHaveLength(1);
    expect(res.projects[0]!.name).toBe('P');
  });

  it('throws ApiError for non-2xx responses (preserves ERR-NNN and correlation ID)', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 'ERR-002', message: 'cycle detected', details: ['VR-007'] },
          correlationId: 'abc-123',
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    let caught: ApiError | null = null;
    try {
      await projectsApi.list();
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught!.code).toBe('ERR-002');
    expect(caught!.httpStatus).toBe(422);
    expect(caught!.correlationId).toBe('abc-123');
    expect(caught!.details).toEqual(['VR-007']);
  });

  it('falls back to ERR-006 when error body is not JSON', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('<html>500</html>', {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }),
    );
    let caught: ApiError | null = null;
    try {
      await projectsApi.list();
    } catch (err) {
      caught = err as ApiError;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught!.code).toBe('ERR-006');
  });

  it('sends JSON body on POST and parses 201', async () => {
    const mockFetch = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ project_id: 5, name: 'P5', description: '', created_at: 't' }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const res = await projectsApi.create({ name: 'P5' });
    expect(res.project_id).toBe(5);

    const call = mockFetch.mock.calls[0]!;
    const [url, init] = call as [string, RequestInit];
    expect(url).toBe('/api/projects');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'P5' });
  });
});
