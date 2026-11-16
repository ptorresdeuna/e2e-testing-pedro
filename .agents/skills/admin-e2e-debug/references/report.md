# Required report

Use this shape for successful, partial, and blocked runs. Omit secrets and sensitive payloads. Use the user's conversation language for explanations.

```markdown
## admin-e2e-debug

Selected specs: <resolved paths / IDs>
ADMIN_URL: <url> (given | local reused | local started)
admin-ff: <absolute path + revision when available>
e2e-testing: <absolute path + revision when available>
Evidence: <artifact paths, attempt, environment, freshness limitations>

| Spec | Result | Fix attempts | Classification | Evidence / cause |
| --- | --- | --- | --- | --- |
| <ID> | green / failed / blocked / not reproduced / not run | <count> | <class> | <observed cause, or hypothesis clearly labeled> |

Expected versus observed: <behavior and failing step>
Backend evidence: <relevant operation, status/transport result, redacted fields; or unavailable / not relevant>
Admin evidence: <source/history/runtime evidence; confirmed versus suspected attribution>
Changes: <repository, files, causal fix; all UNCOMMITTED>
Verification: <exact commands and observed outcomes, including failed checks>
Shared impact: <affected Admin E2Es; execution requested, approved/declined/pending, actual outcomes>
Not verified: <tests/checks not run, local versus remote limitations, flaky proof limits>
Blocked: <spec, reason, next evidence or decision needed>
User decisions: <question → answer>
```

Report a cause as confirmed only when the evidence supports it. A green rerun, an HTTP acceptance status, or a source change alone does not prove backend completion, deployed behavior, or flaky stability.
