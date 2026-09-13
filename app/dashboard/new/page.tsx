import { createClient } from "@/lib/supabase/server";
import Recorder from "@/components/record/Recorder";
import ProximityGate from "@/components/record/ProximityGate";
import type { Subject } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewCoursePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subjects } = await supabase
    .from("subjects")
    .select("*")
    .eq("user_id", user!.id)
    .order("name");

  return (
    <div>
      <h1 className="text-center text-2xl font-bold text-ink">Nouveau cours</h1>
      <p className="mx-auto mt-2 max-w-md text-center text-sm text-ink/50">
        Lance l'enregistrement au début de l'amphi et arrête-le à la fin. Pas besoin de
        prendre de notes.
      </p>
      <div className="mt-10">
        <ProximityGate>
          <Recorder initialSubjects={(subjects ?? []) as Subject[]} />
        </ProximityGate>
      </div>
    </div>
  );
}
