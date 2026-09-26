# Security Specification - AnonBoard

## Data Invariants
- A user can only manage their own profile.
- Messages must be sent to a valid recipient.
- Messages are anonymous; anyone can create them (public access), but only the recipient can read them.
- Timestamps must be server-generated.
- Document IDs must be well-formed strings.
- Watermark text must be within a reasonable length (e.g., 100 characters).

## The Dirty Dozen (Attack Payloads)
1. **Identity Theft**: User A tries to update User B's profile.
2. **Watermark Bloat**: User tries to set a 1MB watermark string.
3. **Privilege Escalation**: User tries to set an `isAdmin` field in their profile.
4. **Message Hijacking**: User A tries to read User B's messages.
5. **Timestamp Spoofing**: Sender tries to set a past `createdAt` date for a message.
6. **Recipient Poisoning**: Sender tries to set `recipientUid` to a random ID that doesn't exist.
7. **Phantom Messages**: Trying to update a message after it's been sent (messages should be immutable except maybe for owner reactions).
8. **ID Poisoning**: Using a 2KB string as a message ID.
9. **Spam Creation**: Creating messages without required content.
10. **Reaction Tampering**: Anonymous sender tries to set reactions to 1 million.
11. **Profile Deletion**: Unauthorized user trying to delete someone else's profile.
12. **Collection Scraping**: Trying to list all users in the system.

## Test Scenarios
- [ ] Create user profile (Self: PASS, Other: FAIL)
- [ ] Read profile (Public: PASS - needed for sending UI)
- [ ] Create message (Public: PASS, with valid recipient)
- [ ] Read message (Owner: PASS, Public: FAIL, Other User: FAIL)
- [ ] Update profile watermark (Self: PASS, Other: FAIL, Size > 100: FAIL)
- [ ] Update message (Owner: PASS for reactions, Other: FAIL)
