import { useMemo } from "react";
import s from "../../sidebar.module.css";
import { PropertiesSection } from "../PropertiesSection";
import { usePropertiesPanel } from "../PropertiesPanelContext";
import { IconArrowDown, IconArrowUp } from "../../icons";

export function OrderSection() {
  const { block, moveBlockOrder } = usePropertiesPanel();

  // Valores atuais para exibição no cabeçalho da seção
  const currentValues = useMemo((): Record<string, string> | undefined => {
    if (!block) return undefined;
    return {
      "Ordem": `Posição no arquivo: ${block.id}`, // O índice ajuda a identificar o bloco [1]
    };
  }, [block]);

  if (!block) return null;

  return (
    <PropertiesSection
      title="Ordenação (Z-Order)"
      currentValues={currentValues}
    >
      <div className={s.grid2}>
        <button
          className={s.smallBtn}
          onClick={() => moveBlockOrder(Number(block.id), "up")}
          title="Move o bloco para depois no arquivo, trazendo-o para frente"
        >
          Trazer para Frente
          <IconArrowUp />
        </button>
        <button
          className={s.smallBtn}
          onClick={() => moveBlockOrder(Number(block.id), "down")}
          title="Move o bloco para antes no arquivo, enviando-o para trás"
        >
          Enviar para Trás
          <IconArrowDown />
        </button>
      </div>
    </PropertiesSection>
  );
}