import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const wsConnectionDuration = new Trend('ws_connection_duration');
const wsMessageErrors = new Counter('ws_message_errors');

export const options = {
  stages: [
    { duration: '20s', target: 20 },
    { duration: '40s', target: 50 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    'ws_connection_duration': ['p(95)<500'],
  },
};

// ⚡ Self-healing setup: Auto-provisions test user or logs in if they already exist
export function setup() {
  const email = 'loadtest_user_99@test.com';
  const password = 'password123';
  const headers = { 'Content-Type': 'application/json' };

  // 1. Try to register the user (safely ignored if unique constraint triggers)
  const regRes = http.post('http://localhost:8080/api/v1/auth/register', JSON.stringify({
    username: 'loadtest99',
    email: email,
    password: password
  }), { headers });

  if (regRes.status !== 200 && regRes.status !== 201) {
    console.log(`ℹ️ [k6 Setup] User ${email} likely already exists (Proceeding to login).`);
  }

  // 2. Execute Login to fetch a fresh JWT Access Token
  const loginRes = http.post('http://localhost:8080/api/v1/auth/login', JSON.stringify({
    email: email,
    password: password
  }), { headers });

  if (loginRes.status !== 200) {
    console.error(`❌ [k6 Setup Error] Login failed with status ${loginRes.status}: ${loginRes.body}`);
    return { token: null };
  }

  let token = '';
  try {
    const body = JSON.parse(loginRes.body);
    token = body.data?.access_token || body.access_token || body.token || body.data?.token || '';
  } catch (e) {
    console.error('❌ [k6 Setup Error] Failed to parse JSON login response:', loginRes.body);
  }

  if (!token) {
    console.error('❌ [k6 Setup Error] Login succeeded but token was empty:', loginRes.body);
  } else {
    console.log('🟢 [k6 Setup Success] Active session established. Token acquired.');
  }

  return { token: token };
}

export default function (data) {
  if (!data || !data.token) {
    return;
  }

  const url = `ws://localhost:8080/ws?token=${data.token}`;
  const startTime = Date.now();

  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', function () {
      const duration = Date.now() - startTime;
      wsConnectionDuration.add(duration);
      
      socket.setInterval(function () {
        socket.send(JSON.stringify({
          type: 'CHAT_MESSAGE',
          room_id: 'test-room-1',
          content: 'Hello from k6 load test virtual user!',
        }));
      }, 3000);
    });

    socket.on('message', function (message) {
      check(message, { 'received message frame': (msg) => msg !== null });
    });

    socket.on('error', function (e) {
      wsMessageErrors.add(1);
    });

    socket.setTimeout(function () {
      socket.close();
    }, 10000);
  });

  check(res, { 'status is 101 switching protocols': (r) => r && r.status === 101 });
  sleep(1);
}