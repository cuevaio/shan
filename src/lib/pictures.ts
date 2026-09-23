export const PICTURES = [
  {
    id: "card",
    src: "/images/card.png",
    alt: "A matte charcoal debit card",
    label: "Card",
  },
  {
    id: "transfer",
    src: "/images/transfer.png",
    alt: "A folded statement and a pen on a pale desk",
    label: "Transfer",
  },
  {
    id: "member",
    src: "/images/member.png",
    alt: "A member in a charcoal coat",
    label: "Member",
  },
] as const;

export type PictureId = (typeof PICTURES)[number]["id"];
