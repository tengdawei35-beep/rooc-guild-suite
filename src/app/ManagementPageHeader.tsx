import type { ReactNode } from "react";
import Link from "next/link";

type ManagementPageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  breadcrumb?: { label: string; href: string };
  actions?: ReactNode;
};

export default function ManagementPageHeader({
  title,
  description,
  eyebrow,
  breadcrumb,
  actions,
}: ManagementPageHeaderProps) {
  return (
    <header className="hmdl-page-header">
      {breadcrumb && (
        <Link className="hmdl-page-breadcrumb" href={breadcrumb.href}>
          <span aria-hidden="true">←</span> {breadcrumb.label}
        </Link>
      )}
      <div className="hmdl-page-header-main">
        <div className="hmdl-page-header-copy">
          {eyebrow && <p className="hmdl-page-eyebrow">{eyebrow}</p>}
          <h1 className="hmdl-page-title">{title}</h1>
          {description && <p className="hmdl-page-description">{description}</p>}
        </div>
        {actions && <div className="hmdl-page-header-actions">{actions}</div>}
      </div>
    </header>
  );
}
