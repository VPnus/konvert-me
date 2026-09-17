import { Link } from 'react-router-dom';

import { buttonVariants } from '@/components/ui/button';
import { strings } from '@/i18n';

export default function NotFoundPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{strings.pages.notFound.title}</h1>
      <p className="text-sm text-muted-foreground">{strings.pages.notFound.subtitle}</p>
      <Link to="/overview" className={buttonVariants()}>
        {strings.pages.notFound.action}
      </Link>
    </section>
  );
}
