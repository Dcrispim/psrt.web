import {
  CompileStep,
  type CompileStepContext,
  type CompileStepObservers,
} from '@psrt/sdk';

export type HtmlCompileStepCallback = (ctx: CompileStepContext) => void;

export interface HtmlCompileProgress {
  phase: 'assets' | 'compile';
  step?: (typeof CompileStep)[keyof typeof CompileStep];
  label: string;
  detail?: string;
}

export const ASSETS_PHASE_PROGRESS: HtmlCompileProgress = {
  phase: 'assets',
  label: 'Resolvendo assets locais…',
};

const GRANULAR_STEPS = new Set<string>([
  CompileStep.ADAPT_STYLE,
  CompileStep.RENDER_TEXT,
  CompileStep.RENDER_INLINE,
  CompileStep.RENDER_MASK,
]);

const STEP_LABELS: Record<string, string> = {
  [CompileStep.RESOLVE]: 'Expandindo constantes',
  [CompileStep.BUILD_ASSETS]: 'Preparando imagens e fontes',
  [CompileStep.ADAPT_STYLE]: 'Adaptando estilos',
  [CompileStep.RENDER_FONTS]: 'Gerando fontes',
  [CompileStep.RENDER_HEAD]: 'Montando cabeçalho',
  [CompileStep.RENDER_PAGE]: 'Renderizando página',
  [CompileStep.RENDER_TEXT]: 'Renderizando textos',
  [CompileStep.RENDER_MASK]: 'Renderizando máscaras',
  [CompileStep.RENDER_INLINE]: 'Processando markup',
  [CompileStep.FINALIZE]: 'Finalizando HTML',
};

export function compileStepLabel(ctx: CompileStepContext): string {
  return STEP_LABELS[ctx.step] ?? 'Compilando HTML…';
}

export function compileStepDetail(ctx: CompileStepContext): string | undefined {
  switch (ctx.step) {
    case CompileStep.BUILD_ASSETS:
      return ctx.assetCount > 0 ? `${ctx.assetCount} asset(s)` : undefined;
    case CompileStep.RENDER_FONTS:
      return ctx.fontCount > 0 ? `${ctx.fontCount} fonte(s)` : undefined;
    case CompileStep.RENDER_HEAD:
      return ctx.title;
    case CompileStep.RENDER_PAGE:
      return `${ctx.pageName} · ${ctx.canvasW}×${ctx.canvasH}`;
    case CompileStep.ADAPT_STYLE:
      return `${ctx.pageName} · bloco ${ctx.blockIndex} (${ctx.kind})`;
    case CompileStep.RENDER_TEXT:
      return `${ctx.pageName} · texto ${ctx.textIndex}`;
    case CompileStep.RENDER_MASK:
      return `${ctx.pageName} · máscara ${ctx.maskIndex}`;
    case CompileStep.RENDER_INLINE:
      return `${ctx.pageName} · texto ${ctx.textIndex}`;
    case CompileStep.FINALIZE:
      return `${ctx.pageCount} página(s) · ${Math.round(ctx.htmlLength / 1024)} KB`;
    default:
      return undefined;
  }
}

export function htmlCompileProgressFromStep(ctx: CompileStepContext): HtmlCompileProgress {
  return {
    phase: 'compile',
    step: ctx.step,
    label: compileStepLabel(ctx),
    detail: compileStepDetail(ctx),
  };
}

export function createHtmlCompileObservers(
  onStep?: HtmlCompileStepCallback,
): CompileStepObservers | undefined {
  if (!onStep) return undefined;

  let rafId: number | null = null;
  let pending: CompileStepContext | null = null;

  const flush = (): void => {
    rafId = null;
    if (pending) {
      onStep(pending);
      pending = null;
    }
  };

  const notify = (ctx: CompileStepContext): void => {
    if (GRANULAR_STEPS.has(ctx.step)) {
      pending = ctx;
      if (rafId === null) {
        rafId = requestAnimationFrame(flush);
      }
      return;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      pending = null;
    }
    onStep(ctx);
  };

  const handler = (ctx: CompileStepContext): void => notify(ctx);
  return {
    [CompileStep.RESOLVE]: [handler],
    [CompileStep.BUILD_ASSETS]: [handler],
    [CompileStep.ADAPT_STYLE]: [handler],
    [CompileStep.RENDER_FONTS]: [handler],
    [CompileStep.RENDER_HEAD]: [handler],
    [CompileStep.RENDER_PAGE]: [handler],
    [CompileStep.RENDER_TEXT]: [handler],
    [CompileStep.RENDER_MASK]: [handler],
    [CompileStep.RENDER_INLINE]: [handler],
    [CompileStep.FINALIZE]: [handler],
  };
}
