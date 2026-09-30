import type { AnchorHTMLAttributes, PropsWithChildren } from "react";

export default function Link({ children, ...props }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) {
  return <a {...props}>{children}</a>;
}
