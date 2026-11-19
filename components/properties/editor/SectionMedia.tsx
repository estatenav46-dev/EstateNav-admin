'use client';

import { Field, SubSection, toNullableText } from '@/components/ui/form';
import { MediaUploader } from '../MediaUploader';
import { PLACEHOLDER_COVER } from './model';
import { SectionCard, useDraft } from './ui';

export function SectionMedia() {
  const { register, watch, setValue, getValues, formState } = useDraft();
  const gallery = watch('media.gallery') ?? [];
  const cover = watch('media.cover');
  const masterPlan = watch('media.masterPlan');
  const title = watch('title');
  const id = getValues('id');
  const errors = formState.errors.media;

  return (
    <SectionCard id="media" aside={<span className="rounded-full bg-surface-2 px-3 py-1 text-2xs font-medium text-ink-muted">{gallery.length} photos</span>}>
      <SubSection title="Photo gallery" description="Elevation renders, amenities, show-flat and site photos. The cover leads every card and the project page. At least one photo is needed to publish.">
        <MediaUploader
          label=""
          images={gallery}
          onChange={(imgs) => {
            setValue('media.gallery', imgs, { shouldDirty: true });
            if (!imgs.length) setValue('media.cover', PLACEHOLDER_COVER, { shouldDirty: true });
          }}
          storagePath={`properties/${id}/gallery`}
          coverId={cover && cover.id !== PLACEHOLDER_COVER.id ? cover.id : undefined}
          onSetCover={(img) => setValue('media.cover', img, { shouldDirty: true })}
          altPrefix={title || 'Project'}
        />
        {errors?.gallery && <p className="text-2xs text-danger">Every photo needs a short description (alt text).</p>}
      </SubSection>

      <SubSection title="Master plan" description="Site layout image. Upload the PDF version under Documents if you have one.">
        <MediaUploader
          label=""
          images={masterPlan ? [masterPlan] : []}
          onChange={(imgs) => setValue('media.masterPlan', imgs[0] ?? null, { shouldDirty: true })}
          storagePath={`properties/${id}/masterplan`}
          max={1}
          altPrefix={`${title || 'Project'} master plan`}
        />
      </SubSection>

      <SubSection title="Video & virtual tour" description="Links only; they open from the project page.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Walkthrough video (YouTube or Vimeo link)" error={errors?.videoUrl ? 'Enter a full link starting with https://' : undefined}>
            <input type="url" {...register('media.videoUrl', toNullableText)} className="field" placeholder="https://www.youtube.com/watch?v=…" />
          </Field>
          <Field label="Virtual tour / 3D tour link" error={errors?.virtualTourUrl ? 'Enter a full link starting with https://' : undefined}>
            <input type="url" {...register('media.virtualTourUrl', toNullableText)} className="field" placeholder="https://…" />
          </Field>
        </div>
      </SubSection>
    </SectionCard>
  );
}
