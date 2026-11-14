# Website sharing preview

The site previously omitted an explicit Open Graph image, allowing social platforms to select a picture heuristically or reuse an older cached preview.

The root layout now supplies an absolute 1200 × 630 PNG image, Open Graph title/description/type/site name and Twitter large-card metadata. `/social-preview-20261114` renders the current homepage château photograph with the current Côte de Duras name and positioning. It is a static versioned response.

Facebook sharing, native device sharing and clipboard fallback use the same versioned homepage URL (`?share=20261114`). The homepage returns that exact Open Graph URL for the recognized version, while retaining the unversioned search-engine canonical. Unknown query values cannot inject a different host or image. Profile follow buttons still link directly to the verified Facebook and Instagram accounts.

The iOS preview's entry-sharing buttons retain their event/service deep links. They inherit the new default social image; third-party source URLs stored in old favourites remain owned by those external sites.

Existing already-published social attachments can retain their own platform cache. Do not describe them as changed without observing them. Verify the rendered crawler HTML, image response and button destinations after deployment. A Facebook sign-in wall is a verification limitation, not evidence that Facebook has rendered the new card.
