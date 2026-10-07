
"use client";

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Users } from 'lucide-react';

export default function StaffPortalPage() {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <Card className="w-full max-w-2xl mt-10 shadow-lg bg-card">
        <CardHeader className="text-center">
          <Users className="mx-auto h-12 w-12 text-primary mb-2" />
          <CardTitle className="text-2xl text-card-foreground">Staff Portal</CardTitle>
          <CardDescription>This section is under development.</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <img
            src="https://placehold.co/600x300.png"
            alt="Staff Portal Coming Soon"
            data-ai-hint="team office"
            className="mx-auto rounded-md mb-6 shadow-md"
          />
          <p className="mb-6 text-muted-foreground">
            Features for managing staff, their roles, and other internal information will be available here.
          </p>
          <Link href="/dashboard" passHref>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
