import { useTitle } from '../components/ui';

export function NotFound({ message = 'This page does not exist.' }: { message?: string }) {
  useTitle('Not found');
  return (
    <div className="page">
      <div className="empty">
        <h2>Not found</h2>
        <p>{message}</p>
        <div className="row">
          <a className="btn btn--primary" href="#/">
            Back to Explore
          </a>
        </div>
      </div>
    </div>
  );
}
