<!--
The first message of a Dialogue session. Monteverdi's code assembles it from the parts
below, in order, and fills each {placeholder}. Before it starts a session, code has already
written the user's message into the Dialogue file as the last turn.

Fresh session (no session yet, or the old one is cold and large): parts 1-3.
Warm resume: part 4 only.
-->

<!-- 1. Always (fresh session). -->
This is the Dialogue on "{title}" ({id}) with {name}. You're in the endeavor's worktree at
{worktree_path}; paths in this message are relative to it.

<breadcrumb>
{breadcrumb}
</breadcrumb>

<!-- 2. If the Dialogue file has turns (fresh session). -->
The conversation so far is below. You're joining it in a fresh session, so the earlier
session's context is gone; this file, findings included, is the record. Re-read only the
code you need.

<dialogue>
{dialogue}
</dialogue>

<!-- 3. The trigger (fresh session): exactly one of these. -->
<!-- 3a. The user wrote. -->
Reply to {name}'s last turn.
<!-- 3b. The user opened the Dialogue without a message. -->
{name} opened this Dialogue and is waiting for your first turn: your understanding of the
endeavor and the first decision in front of it.
<!-- 3c. The user pressed Finalize. -->
{name} asked you to finalize now.

<!-- 4. Warm resume: turns added to the file since the session last saw it, if any (for
     example another session's reopen), then the user's message as written, or the
     finalize line. -->
New in the Dialogue since your last turn:

<dialogue>
{new_turns}
</dialogue>

{message | "{name} asked you to finalize now."}
