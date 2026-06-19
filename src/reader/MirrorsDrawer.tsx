import { useEffect, useState, type ReactNode } from "react";
import s from "./reader.module.css";
import { loadMirrors, newId, saveMirrors, type Mirror } from '../services/mirrorsStore';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MirrorsDrawer({ open, onClose }: Props) {
  const [mirrors, setMirrors] = useState<Mirror[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState<Mirror | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (open) setMirrors(loadMirrors());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function commit(next: Mirror[]) {
    setMirrors(next);
    saveMirrors(next);
  }

  function handleSave(name: string, url: string) {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl) return;
    if (editing) {
      commit(mirrors.map((m) => (m.id === editing.id ? { ...m, name: trimmedName, url: trimmedUrl } : m)));
    } else {
      commit([...mirrors, { id: newId(), name: trimmedName, url: trimmedUrl }]);
    }
    setEditing(null);
    setModalOpen(false);
  }

  function handleDelete(id: string) {
    commit(mirrors.filter((m) => m.id !== id));
  }

  function onDragStart(index: number) {
    setDragIndex(index);
  }
  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDropIndex(index);
  }
  function onDrop() {
    if (dragIndex === null || dropIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDropIndex(null);
      return;
    }
    const next = [...mirrors];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    commit(next);
    setDragIndex(null);
    setDropIndex(null);
  }

  if (!open) return null;

  return (
    <>
      <div className={s.drawerScrim} onClick={onClose} />
      <aside className={s.drawer} role="dialog" aria-label="Mirrors">
        <div className={s.drawerHead}>
          <span className={s.drawerTitle}>Mirrors</span>
          <button className={s.closeBtn} onClick={onClose} aria-label="Fechar">
            <Icon name="x" />
          </button>
        </div>

        <div className={s.drawerToolbar}>
          <button
            className={s.primaryBtn}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Icon name="plus" /> Adicionar mirror
          </button>
        </div>

        <div className={s.mirrorList} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          {mirrors.length === 0 ? (
            <div className={s.mirrorEmpty}>
              Nenhum mirror cadastrado.
              <br />
              Adicione um repositório para começar.
            </div>
          ) : (
            mirrors.map((m, i) => (
              <div
                key={m.id}
                className={s.mirrorItem}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={(e) => onDragOver(e, i)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                data-dragging={dragIndex === i || undefined}
                data-drop-target={dropIndex === i && dragIndex !== i || undefined}
              >
                <span className={s.handle} aria-label="Arrastar">
                  <Icon name="grip" />
                </span>
                <span className={s.rank}>{i + 1}</span>
                <div className={s.mirrorInfo}>
                  <span className={s.mirrorName}>{m.name}</span>
                  <span className={s.mirrorUrl}>{m.url}</span>
                </div>
                <div className={s.mirrorActions}>
                  <button
                    className={s.miniBtn}
                    aria-label="Editar"
                    onClick={() => {
                      setEditing(m);
                      setModalOpen(true);
                    }}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    className={`${s.miniBtn} ${s.danger}`}
                    aria-label="Excluir"
                    onClick={() => handleDelete(m.id)}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {modalOpen && (
        <MirrorModal
          initial={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}
    </>
  );
}

function MirrorModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Mirror | null;
  onClose: () => void;
  onSave: (name: string, url: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");

  return (
    <div className={s.modalScrim} onClick={onClose}>
      <form
        className={s.modal}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name, url);
        }}
      >
        <div className={s.modalTitle}>{initial ? "Editar mirror" : "Novo mirror"}</div>
        <div className={s.field}>
          <label className={s.label} htmlFor="mirror-name">Nome</label>
          <input
            id="mirror-name"
            className={s.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Repositório principal"
            autoFocus
          />
        </div>
        <div className={s.field}>
          <label className={s.label} htmlFor="mirror-url">URL</label>
          <input
            id="mirror-url"
            className={s.input}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://exemplo.com/repo.json"
            type="url"
          />
        </div>
        <div className={s.modalActions}>
          <button type="button" className={s.ghostBtn} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={s.primaryBtn}>
            {initial ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Icon({ name }: { name: string }) {
  const p: Record<string, ReactNode> = {
    x: <path d="M6 6l12 12M18 6L6 18" />,
    plus: <path d="M12 5v14M5 12h14" />,
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>
    ),
    trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
    grip: (
      <>
        <circle cx="9" cy="6" r="1" />
        <circle cx="9" cy="12" r="1" />
        <circle cx="9" cy="18" r="1" />
        <circle cx="15" cy="6" r="1" />
        <circle cx="15" cy="12" r="1" />
        <circle cx="15" cy="18" r="1" />
      </>
    ),
  };
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {p[name]}
    </svg>
  );
}
