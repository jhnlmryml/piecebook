export type CommentTimelineEntry = {
  id: string;
  user_id: string;
  created_at: string;
};

export function compareComments(
  first: Pick<CommentTimelineEntry, "created_at" | "id">,
  second: Pick<CommentTimelineEntry, "created_at" | "id">,
) {
  return (
    new Date(first.created_at).getTime() -
      new Date(second.created_at).getTime() ||
    first.id.localeCompare(second.id)
  );
}

export function areCommentsGrouped(
  first: CommentTimelineEntry | undefined,
  second: CommentTimelineEntry | undefined,
) {
  return Boolean(
    first &&
      second &&
      first.user_id === second.user_id &&
      new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime() <=
        5 * 60 * 1000,
  );
}

export function scrollToCommentContentBottom(scroller: HTMLElement) {
  const bottomPadding =
    Number.parseFloat(window.getComputedStyle(scroller).paddingBottom) || 0;
  scroller.scrollTop = Math.max(
    0,
    scroller.scrollHeight - scroller.clientHeight - bottomPadding,
  );
}
