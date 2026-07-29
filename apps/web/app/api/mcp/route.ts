// AGENT INSTRUCTION: After every write (INSERT/UPDATE/DELETE), you MUST:
// 1. Insert activity feed entry
// 2. Call pg.notify('project_e_events', JSON.stringify({ type, action, id, workspace_id }))
// See AGENTS.md for full rules.

import { NextRequest, NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '@/lib/mcp/server';
import { createAdminClient } from '@/lib/pocketbase';

// Store transports by session ID for stateful mode
const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

async function authenticateRequest(request: NextRequest): Promise<boolean> {
  // Check for API key in Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;

  const apiKey = authHeader.replace('Bearer ', '').trim();
  if (!apiKey) return false;

  try {
    const pb = createAdminClient();
    // Look up agent by API key
    const result = await pb.collection('agents').getList(1, 1, {
      filter: `api_key = "${apiKey}" && status = "active"`,
    });
    return result.items.length > 0;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // Authenticate
  if (!(await authenticateRequest(request))) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid API key in the Authorization header.' },
      { status: 401 }
    );
  }

  // Create server and transport for SSE connection
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  await server.connect(transport);

  // Handle the request first — sessionId is set during handleRequest
  const response = await transport.handleRequest(request);

  // Store transport AFTER handleRequest sets the session ID
  if (transport.sessionId) {
    transports.set(transport.sessionId, transport);
  }

  return response;
}

export async function POST(request: NextRequest) {
  // Authenticate
  if (!(await authenticateRequest(request))) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid API key in the Authorization header.' },
      { status: 401 }
    );
  }

  // Get session ID from header
  const sessionId = request.headers.get('mcp-session-id');

  if (sessionId) {
    // Route to existing transport
    const transport = transports.get(sessionId);
    if (transport) {
      return transport.handleRequest(request);
    }
    return NextResponse.json(
      { error: 'Session not found. Connect via GET first.' },
      { status: 404 }
    );
  }

  // No session ID — this should be an initialization request
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  await server.connect(transport);

  // Handle the request first — sessionId is set during handleRequest
  const response = await transport.handleRequest(request);

  // Store transport AFTER handleRequest sets the session ID
  if (transport.sessionId) {
    transports.set(transport.sessionId, transport);
  }

  return response;
}

export async function DELETE(request: NextRequest) {
  // Authenticate
  if (!(await authenticateRequest(request))) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid API key in the Authorization header.' },
      { status: 401 }
    );
  }

  const sessionId = request.headers.get('mcp-session-id');
  if (!sessionId) {
    return NextResponse.json(
      { error: 'Missing mcp-session-id header' },
      { status: 400 }
    );
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  // Handle the DELETE to terminate the session
  const response = await transport.handleRequest(request);

  // Clean up
  transports.delete(sessionId);

  return response;
}