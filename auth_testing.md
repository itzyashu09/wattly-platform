# Auth-Gated App Testing Playbook (WATTLY)

## Step 1: Create Test User & Session
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Backend cURL
```
curl -X GET "$URL/api/auth/me" -H "Authorization: Bearer $TOKEN"
curl -X GET "$URL/api/shares/mine" -H "Authorization: Bearer $TOKEN"
curl -X GET "$URL/api/credits/ledger" -H "Authorization: Bearer $TOKEN"
```

## Step 3: Browser Cookie Setup
```
await page.context.add_cookies([{
    "name": "session_token",
    "value": "TOKEN",
    "domain": "your-app.com",
    "path": "/",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None"
}]);
```

## Success Indicators
- /api/auth/me returns user data
- Dashboard loads (no redirect to /)
- /api/shares/mine, /api/credits/ledger respond 200
