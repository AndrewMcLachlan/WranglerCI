import { Badge } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { MergeBlocker, PullRequestModel } from "../../../api";

type IconProp = React.ComponentProps<typeof FontAwesomeIcon>["icon"];

const blockerBadges: Record<Exclude<MergeBlocker, "UnresolvedConversations">, { label: string; title: string; icon: IconProp; className: string }> = {
  Draft: { label: "Draft", title: "Still a draft", icon: "pencil", className: "blocker-draft" },
  Conflict: { label: "Conflict", title: "Has merge conflicts", icon: "triangle-exclamation", className: "blocker-conflict" },
  Behind: { label: "Behind", title: "Must be brought up to date with its base branch", icon: "code-branch", className: "blocker-behind" },
  ChangesRequested: { label: "Changes requested", title: "A reviewer has requested changes", icon: "file-pen", className: "blocker-changes-requested" },
  NeedsReview: { label: "Needs review", title: "Your pull request needs someone else's approval", icon: "user-check", className: "blocker-needs-review" },
  Blocked: { label: "Blocked", title: "A branch rule blocks the merge, such as a failing required check", icon: "lock", className: "blocker-blocked" },
};

export const unresolvedCount = (pr: PullRequestModel) => Number(pr.unresolvedThreads ?? 0);

/** What stops the merge, then any unresolved conversations: filled when they block it, outlined when they don't. */
export const MergeBlockerBadges: React.FC<{ pullRequest: PullRequestModel }> = ({ pullRequest }) => {
  const blockers = pullRequest.blockers ?? [];
  const unresolved = unresolvedCount(pullRequest);
  const blocking = blockers.includes("UnresolvedConversations");
  const conversations = `${unresolved === 1 ? "1 unresolved conversation" : `${unresolved} unresolved conversations`}${blocking ? "" : ", not blocking the merge"}`;

  return (
    <>
      {blockers.filter((b) => b !== "UnresolvedConversations").map((blocker) => {
        const badge = blockerBadges[blocker as keyof typeof blockerBadges];
        return (
          <Badge key={blocker} className={badge.className} icon={<FontAwesomeIcon icon={badge.icon} />} title={badge.title}>
            {badge.label}
          </Badge>
        );
      })}
      {unresolved > 0 && (
        <Badge
          className={blocking ? "blocker-unresolved" : "blocker-unresolved advisory"}
          icon={<FontAwesomeIcon icon="comment" />}
          title={conversations}
          aria-label={conversations}
        >
          {unresolved} unresolved
        </Badge>
      )}
    </>
  );
};
