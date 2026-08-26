import { useState, type FormEvent } from "react";
import { useBoardStore } from "../../../state/boardStore";
import styles from "./BoardSwitcher.module.css";

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// Self-contained popover, same open/overlay pattern as CreateNodeButton and
// ExportButton — lists every board (click to switch), inline rename,
// delete (hidden once only one board remains, matching statusService's
// "a type always needs a default" convention of never letting the UI reach
// an unusable empty state), and an "add board" row at the bottom.
export function BoardSwitcher() {
  const boards = useBoardStore((s) => s.boards);
  const currentBoardId = useBoardStore((s) => s.currentBoardId);
  const selectBoard = useBoardStore((s) => s.selectBoard);
  const createBoard = useBoardStore((s) => s.createBoard);
  const renameBoard = useBoardStore((s) => s.renameBoard);
  const deleteBoard = useBoardStore((s) => s.deleteBoard);

  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newBoardName, setNewBoardName] = useState("");

  const current = boards.find((b) => b.id === currentBoardId);
  const sorted = [...boards].sort((a, b) => a.sortOrder - b.sortOrder);

  function startRename(id: string, name: string) {
    setRenamingId(id);
    setRenameValue(name);
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) renameBoard(renamingId, renameValue.trim());
    setRenamingId(null);
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    createBoard({ name: newBoardName.trim() });
    setNewBoardName("");
    setOpen(false);
  }

  return (
    <div className={styles.wrapper}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)} aria-label="Switch board">
        <span className={styles.currentName}>{current?.name ?? "Board"}</span>
        <ChevronDownIcon />
      </button>

      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} />
          <div className={styles.menu}>
            {sorted.map((board) => (
              <div
                key={board.id}
                className={`${styles.boardRow} ${board.id === currentBoardId ? styles.boardRowActive : ""}`}
              >
                {renamingId === board.id ? (
                  <input
                    className={styles.renameInput}
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className={styles.boardName}
                    onClick={() => {
                      selectBoard(board.id);
                      setOpen(false);
                    }}
                  >
                    {board.name}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.iconButton}
                  title="Rename board"
                  aria-label={`Rename ${board.name}`}
                  onClick={() => startRename(board.id, board.name)}
                >
                  ✎
                </button>
                {boards.length > 1 && (
                  <button
                    type="button"
                    className={styles.iconButtonDanger}
                    title="Delete board"
                    aria-label={`Delete ${board.name}`}
                    onClick={() => deleteBoard(board.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            <form className={styles.addForm} onSubmit={handleCreate}>
              <input
                className={styles.addInput}
                placeholder="New board name"
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
              />
              <button type="submit" className={styles.addButton} disabled={!newBoardName.trim()}>
                Add
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
