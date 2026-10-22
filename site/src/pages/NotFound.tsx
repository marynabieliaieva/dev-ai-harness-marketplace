import { useTitle } from '../components/ui';
import { t } from '../i18n';

export function NotFound({ message = t.notFound.page }: { message?: string }) {
  useTitle(t.notFound.title);
  return (
    <div className="page">
      <div className="empty">
        <h2>{t.notFound.title}</h2>
        <p>{message}</p>
        <div className="row">
          <a className="btn btn--primary" href="#/">
            {t.notFound.back}
          </a>
        </div>
      </div>
    </div>
  );
}
