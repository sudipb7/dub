import { fetcher } from "@dub/utils";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { z } from "zod";
import { programResourcesSchema } from "../zod/schemas/program-resources";
import useWorkspace from "./use-workspace";

export type ProgramResourcesProps = z.infer<typeof programResourcesSchema>;

export default function useProgramResources() {
  const { id: workspaceId } = useWorkspace();
  const { programId } = useParams();

  const {
    data: resources,
    error,
    mutate,
  } = useSWR<ProgramResourcesProps>(
    programId && workspaceId
      ? `/api/programs/${programId}/resources?workspaceId=${workspaceId}`
      : null,
    fetcher,
    {
      dedupingInterval: 60000,
    },
  );

  return {
    resources,
    error,
    mutate,
    loading: programId && !resources && !error,
  };
}
