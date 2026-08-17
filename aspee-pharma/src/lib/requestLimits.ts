import { NextResponse } from 'next/server';

/**
 * Reads and JSON-parses a request body while enforcing a hard byte ceiling,
 * so an oversized payload gets rejected instead of buffered/processed in
 * full. Checks Content-Length first for a cheap early rejection, then
 * verifies the actual decoded size too (Content-Length can be absent or
 * wrong, e.g. under chunked transfer-encoding).
 */
export async function readJsonBody<T = any>(
    request: Request,
    maxBytes: number
): Promise<{ body: T | null; error: NextResponse | null }> {
    const contentLength = request.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxBytes) {
        return { body: null, error: tooLarge(maxBytes) };
    }

    let text: string;
    try {
        text = await request.text();
    } catch {
        return { body: null, error: NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) };
    }

    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
        return { body: null, error: tooLarge(maxBytes) };
    }

    if (!text) {
        return { body: {} as T, error: null };
    }

    try {
        return { body: JSON.parse(text) as T, error: null };
    } catch {
        return { body: null, error: NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }) };
    }
}

function tooLarge(maxBytes: number): NextResponse {
    return NextResponse.json(
        { error: `Request body too large (max ${Math.floor(maxBytes / 1024)}KB).` },
        { status: 413 }
    );
}
