import {
    cp,
    readdir,
    mkdir,
  } from "node:fs/promises";
  
  const source =
    new URL(
      "../generated/prisma/",
      import.meta.url
    );
  
  const target =
    new URL(
      "../dist/generated/prisma/",
      import.meta.url
    );
  
  await mkdir(
    target,
    {
      recursive:
        true,
    }
  );
  
  for (
    const file
    of await readdir(
      source
    )
  ) {
    if (
      file.includes(
        "query_engine"
      ) &&
      file.endsWith(
        ".node"
      )
    ) {
      await cp(
        new URL(
          file,
          source
        ),
  
        new URL(
          file,
          target
        )
      );
    }
  }