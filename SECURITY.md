Sessions should be regenerated after logins and privilege escalations. This prevents session fixation attacks. To regenerate a session, we will use:

```js
req.session.regenerate(function(err) {
  // will have a new session here
})
```

Sessions should be expired when the user logs out or times out. To destroy a session, we can use:

```js
req.session.destroy(function(err) {
  // cannot access session here
})
```

Logging Sessions

Whenever a new session is created, regenerated, or destroyed, it should be logged. Namely, activities like user-role escalation or financial transactions should be logged.

A typical log should contain the timestamp, client IP, resource requested, user ID, and session ID.

This will be helpful to detect session anomalies in case of an attack.

