export const revalidate = 3600; // ISR: revalidate every hour

export default async function BlogPage() {
  return (
    <main>
      <h1>Blog</h1>
      <p>Latest posts, revalidated hourly.</p>
    </main>
  );
}
