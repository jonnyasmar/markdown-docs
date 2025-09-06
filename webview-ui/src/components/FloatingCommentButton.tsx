interface FloatingCommentButtonProps {
  showFloatingButton: boolean;
  floatingButtonPosition: { x: number; y: number };
  selectedText: string;
  setShowCommentModal: (show: boolean) => void;
  setShowFloatingButton: (show: boolean) => void;
}

export const FloatingCommentButton = ({
  showFloatingButton,
  floatingButtonPosition,
  selectedText,
  setShowCommentModal,
  setShowFloatingButton,
}: FloatingCommentButtonProps) => {
  return (
    <div
      className={`floating-comment-button ${showFloatingButton ? 'visible' : ''}`}
      title="Add comment"
      style={{
        left: `${floatingButtonPosition.x + 34}px`,
        top: `${floatingButtonPosition.y}px`,
      }}
      onMouseDown={e => {
        e.preventDefault();
        e.stopPropagation();
        if (selectedText) {
          setShowCommentModal(true);
          setShowFloatingButton(false);
        }
      }}
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        if (selectedText) {
          setShowCommentModal(true);
          setShowFloatingButton(false);
        }
      }}
    >
      💬
    </div>
  );
};
