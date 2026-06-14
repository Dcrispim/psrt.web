import s from "../sidebar.module.css";
import { IconDuplicate, IconPlus, IconTrash } from "../icons";
import { usePropertiesPanel } from "./PropertiesPanelContext";

export function TextBlockBar() {
  const { blocks, activeId, onSelect, onAdd, onDuplicate, onRemove } = usePropertiesPanel();

  return (
    <div className={s.textBar}>
      <select className={s.select} value={activeId} onChange={(e) => onSelect(e.target.value)}>
        {blocks.map((b, i) => (
          <option key={b.id} value={b.id}>
            #{i + 1} — {b.name}
          </option>
        ))}
      </select>
      <button type="button" className={`${s.iconBtn} ${s.primary}`} onClick={onAdd} title="Adicionar bloco">
        <IconPlus />
      </button>
      <button type="button" className={s.iconBtn} onClick={onDuplicate} title="Duplicar bloco">
        <IconDuplicate />
      </button>
      <button type="button" className={`${s.iconBtn} ${s.danger}`} onClick={onRemove} title="Remover bloco">
        <IconTrash />
      </button>
    </div>
  );
}
