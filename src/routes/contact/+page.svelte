<script lang="ts">
  import { BookOpen, Bug, Mail, Monitor, Users, Globe } from '@lucide/svelte';
  import AppBar from '$lib/components/AppBar.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { openExternal } from '$lib/native';
  import { drawer } from '$lib/stores/ui.svelte';

  /*
    Two groups, because they answer different questions. The first is for
    someone who came here still looking for a meeting; the second is for someone
    who wants to talk to whoever makes the app.

    The online-meeting directory earns its place by being the honest answer to
    something this app does not do. There is no worldwide online-meeting list
    here: the aggregator will not serve one, and only about 37% of its virtual
    records carry a usable time zone. Pointing at NA's own directory beats
    pretending otherwise.
  */

  const groups = [
    {
      titleKey: 'RESOURCES',
      links: [
        { titleKey: 'NA_VIRTUAL', label: 'na.org/virtual', url: 'https://na.org/virtual/', icon: Monitor },
        { titleKey: 'NA_LITERATURE', label: 'na.org/literature', url: 'https://na.org/literature/', icon: BookOpen }
      ]
    },
    {
      titleKey: 'ABOUT_THIS_APP',
      links: [
        { titleKey: 'EMAIL_US', label: 'app@bmlt.app', url: 'mailto:app@bmlt.app', icon: Mail },
        { titleKey: 'BUG_REPORT', label: 'github.com/bmlt-enabled/BMLTSearch/issues', url: 'https://github.com/bmlt-enabled/BMLTSearch/issues', icon: Bug },
        { titleKey: 'JOIN_FB_GROUP', label: 'facebook.com/groups/BMLT', url: 'https://www.facebook.com/groups/149214049107349/', icon: Users },
        { titleKey: 'VISIT_WEBSITE', label: 'bmlt.app', url: 'https://bmlt.app/', icon: Globe }
      ]
    }
  ];
</script>

<svelte:head><title>{t('CONTACT')}</title></svelte:head>

<AppBar title={t('CONTACT')} onmenu={() => drawer.toggle()} />

<div class="space-y-6 p-4">
  {#each groups as group (group.titleKey)}
    <section>
      <h2 class="text-text-muted mb-2 px-1 text-xs font-semibold tracking-wide uppercase">{t(group.titleKey)}</h2>
      <!-- One bordered card per group, rows divided inside it, so the two
           groups read as distinct without drawing a rule between every link. -->
      <div class="border-border bg-surface-raised divide-border divide-y overflow-hidden rounded-xl border">
        {#each group.links as link (link.url)}
          {@const Icon = link.icon}
          <button type="button" class="focusable hover:bg-surface-sunken flex w-full items-center gap-3 p-4 text-left transition-colors" onclick={() => openExternal(link.url)}>
            <span class="text-bmlt shrink-0"><Icon size={22} aria-hidden="true" /></span>
            <span class="min-w-0">
              <span class="text-text block text-sm font-semibold">{t(link.titleKey)}</span>
              <span class="text-text-muted block truncate text-xs">{link.label}</span>
            </span>
          </button>
        {/each}
      </div>
    </section>
  {/each}
</div>
