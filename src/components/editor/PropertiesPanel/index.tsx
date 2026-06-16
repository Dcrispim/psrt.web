import { PropertiesPanelProvider, usePropertiesPanel } from "./PropertiesPanelContext";
import { SectionQueueProvider } from "./SectionQueueContext";
import { TextBlockBar } from "./TextBlockBar";
import { AlignmentSection } from "./sections/AlignmentSection";
import { BlurSection } from "./sections/BlurSection";
import { BorderRadiusSection } from "./sections/BorderRadiusSection";
import { ColorsSection } from "./sections/ColorsSection";
import { ContentSection } from "./sections/ContentSection";
import { CssPropsSection } from "./sections/CssPropsSection";
import { OrderSection } from "./sections/OrderSection";
import { PositionSection } from "./sections/PositionSection";
import { ShadowSection } from "./sections/ShadowSection";
import { TexturesSection } from "./sections/TexturesSection";
import { TypographySection } from "./sections/TypographySection";
import type { PropertiesPanelProps } from "./types";

export type { PropertiesPanelProps };

function PropertiesPanelSections() {
  const { block } = usePropertiesPanel();
  if (!block) return null;

  return (
    <>
      <PositionSection />
      <OrderSection />
      <ContentSection />
      <TexturesSection />
      <BorderRadiusSection />
      <BlurSection />
      <ShadowSection />
      <TypographySection />
      <AlignmentSection />
      <ColorsSection />
      <CssPropsSection />
    </>
  );
}

function PropertiesPanelBody() {
  return (
    <>
      <TextBlockBar />
      <PropertiesPanelSections />
    </>
  );
}

export function PropertiesPanel(props: PropertiesPanelProps) {
  return (
    <PropertiesPanelProvider {...props}>
      <SectionQueueProvider>
        <PropertiesPanelBody />
      </SectionQueueProvider>
    </PropertiesPanelProvider>
  );
}
