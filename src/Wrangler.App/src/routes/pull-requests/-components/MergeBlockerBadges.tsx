import { Badge } from "@andrewmclachlan/moo-ds";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { MergeBlocker, PullRequestModel } from "../../../api";

type IconProp = React.ComponentProps<typeof FontAwesomeIcon>["icon"];

const blockerBadges: Record<Exclude<MergeBlocker, "UnresolvedConversations">, { label: string; title: string; icon: IconProp }> = {
  Draft: { label: "Draft", title: "Still a draft", icon: "pencil" },
  Conflict: { label: "Conflict", title: "Has merge conflicts", icon: "triangle-exclamation" },
  Behind: { label: "Behind", title: "Must be brought up to date with its base branch", icon: "code-branch" },
  ChangesRequested: { label: "Changes requested", title: "A reviewer has requested changes", icon: "file-pen" },
  NeedsReview: { label: "Needs review", title: "Your pull request needs someone else's approval", icon: "user-check" },
  Blocked: { label: "Blocked", title: "A branch rule blocks the merge, such as a failing required check", icon: "lock" },
};

export const unresolvedCount = (pr: PullRequestModel) => Number(pr.unresolvedThreads ?? 0);

/** What stops the merge, then any unresolved conversations: red when they block it, amber when they don't. */
export const MergeBlockerBadges: React.FC<{ pullRequest: PullRequestModel }> = ({ pullRequest }) => {
  const blockers = pullRequest.blockers ?? [];
  const unresolved = unresolvedCount(pullRequest);
  const conversations = unresolved === 1 ? "1 unresolved conversation" : `${unresolved} unresolved conversations`;

  return (
    <>
      {blockers.filter((b) => b !== "UnresolvedConversations").map((blocker) => {
        const badge = blockerBadges[blocker as keyof typeof blockerBadges];
        return (
          <Badge key={blocker} className="red" icon={<FontAwesomeIcon icon={badge.icon} />} title={badge.title}>
            {badge.label}
          </Badge>
        );
      })}
      {unresolved > 0 && (
        <Badge
          className={blockers.includes("UnresolvedConversations") ? "red" : "amber"}
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
