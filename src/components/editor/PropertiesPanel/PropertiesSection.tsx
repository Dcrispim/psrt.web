import { Section, type SectionProps } from "../Sections";
import { useSectionQueue } from "./SectionQueueContext";

type PropertiesSectionProps = Omit<SectionProps, "queue" | "pushQueue">;

export function PropertiesSection(props: PropertiesSectionProps) {
  const { openQueue, pushQueue, togglePin, pinOpened } = useSectionQueue();
  return <Section {...props} queue={openQueue} pushQueue={pushQueue} togglePin={togglePin} isPinned={pinOpened.includes(props.title)} />;
}
