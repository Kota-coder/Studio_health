
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
          <p className="text-muted-foreground">Page not found</p>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            The page you are looking for does not exist.
          </p>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
