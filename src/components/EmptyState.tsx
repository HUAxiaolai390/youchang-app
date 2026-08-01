type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-state__cat" aria-hidden="true"><span /></div>
      <h2>{title}</h2>
      <p>{description}</p>
    </section>
  );
}
