export type AdminProposal = {
  summary: string;
  design?: Partial<
    Pick<
      import('../src/lib/types').Template,
      | 'schoolName'
      | 'loopSchoolName'
      | 'background'
      | 'color'
      | 'accent'
      | 'fontSize'
      | 'loopHidePhoto'
      | 'showTechQuotes'
    >
  > & { displayMode?: 'daily' | 'loop' };
  schedule?: { date: string; content: NonNullable<AdminProposal['content']> }[];
  content?: Partial<
    Pick<import('../src/lib/types').Content, 'title' | 'subtitle' | 'body' | 'badge' | 'footer'>
  >;
  periods?: [string, string][];
  refreshSeconds?: 30 | 60 | 120 | 300;
  clockTextScale?: number;
  boardTextScale?: number;
};
export function validateProposal(value: unknown, admin?: boolean): AdminProposal;
export function contentPatch(value: unknown): AdminProposal['content'];

export const designKeys: string[];
