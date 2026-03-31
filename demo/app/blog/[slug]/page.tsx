export async function generateStaticParams() {
  return [
    { slug: 'getting-started' },
    { slug: 'advanced-usage' },
    { slug: 'changelog' },
  ];
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <article>
      <h1>Blog: {slug}</h1>
    </article>
  );
}
