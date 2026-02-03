import {
  HOST,
  PORT,
  AUTH_PASSWORD,
  OPENCLAW_GATEWAY,
  OPENCLAW_TOKEN,
} from "../config";
import type { Worker, Task } from "../types";

/**
 * Send a notification to OpenClaw gateway when a worker needs review. 
 * Returns true if the notification was sent successfully, false otherwise.
 */
export async function notifyClawForReview(
  worker: Worker,
  task: Task
): Promise<boolean> {
  const backendUrl = `http://${HOST}:${PORT}`;

  const targetBranch = task.targetBranch || "main";
  const mergeStrategy = task.mergeStrategy;

  // Build merge instructions based on strategy
  let mergeInstructions: string;
  if (mergeStrategy === "pr") {
    mergeInstructions = `**Merge Strategy: Create Pull Request**
\`\`\`bash
cd ${worker.worktreePath || "<worktree>"}
git push -u origin HEAD
gh pr create --base ${targetBranch} --fill
\`\`\``;
  } else {
    // Default: direct merge via cherry-pick
    mergeInstructions = `**Merge Strategy: Direct (cherry-pick)**
\`\`\`bash
cd ${worker.projectPath || "<project>"}
git cherry-pick <commit-hash> --onto ${targetBranch}
\`\`\`
Or if multiple commits:
\`\`\`bash
cd ${worker.worktreePath || "<worktree>"}
git log --oneline ${targetBranch}..HEAD  # List commits to cherry-pick
cd ${worker.projectPath || "<project>"}
git checkout ${targetBranch}
git cherry-pick <first-commit>^..<last-commit>
\`\`\``;
  }

  const message = `**Worker Review Needed**

Worker **${worker.name}** has completed task: "${task.title}"

**Task ID:** ${task.id}
**Worker ID:** ${worker.id}
**Description:** ${task.description || "(none)"}
**Target Branch:** ${targetBranch}
**Merge Strategy:** ${mergeStrategy || "direct (reviewer decides)"}

Please review the worker's output and complete the task:
1. Read worker logs: \`mcporter call claude-team.read_worker_logs session_id="${worker.name}"\`
2. Check the git diff in their worktree
3. If good -> merge the code, move task to done (see API instructions below), and shutdown the worker
  3a. If code updated the backend, reload it with \`pm2 reload claw-machine-backend\`
  3b. If code updated the frontend, reload it with \`pm2 reload claw-machine-frontend\`
4. If issues -> message the worker with feedback and let it continue, checking back in a few minutes

Worktree: ${worker.worktreePath || "N/A"}
Project: ${worker.projectPath || "N/A"}

---

${mergeInstructions}

---

**How to move task to done via Claw Machine API:**

\`\`\`bash
curl -X PATCH "${backendUrl}/api/tasks/${task.id}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${AUTH_PASSWORD}" \\
  -d '{"status": "done"}'
\`\`\`

**How to send feedback to the worker and request changes:**

\`\`\`bash
mcporter call claude-team.message_workers \\
  session_ids='["${worker.name}"]' \\
  message="<your feedback here>" \\
  wait_mode="none"
\`\`\``;

  try {
    const response = await fetch(`${OPENCLAW_GATEWAY}/hooks/agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(OPENCLAW_TOKEN
          ? { Authorization: `Bearer ${OPENCLAW_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        name: `[Reviewer] ${task.title}`,
        sessionKey: task.projectId,
        agentId: "reviewer",
        wakeMode: "now",
        message,
      }),
    });

    if (response.ok) {
      console.log(`Notified Claw to review worker ${worker.name}`);
      return true;
    } else {
      const errText = await response.text();
      console.error(`Failed to notify Claw: ${response.status} - ${errText}`);
    }
  } catch (error) {
    console.error("Failed to send wake event to OpenClaw:", error);
  }

  return false;
}
