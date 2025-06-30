import { app } from '../../AppService';
import { DBKeys, PageNames } from '../../AppServiceTypes';
import { alertModal } from '../../components/AlertModalComp';
import { idb } from '../../IndexedDB';
import { DocsGlobalState, gd, DocsPageNames } from './DocsTypes';

export async function docsGoHome(gs: DocsGlobalState): Promise<void> {
    gs.pages = [DocsPageNames.treeViewer];
    const userId = await idb.getItem(DBKeys.userId);
    if (!userId) {
        alertModal(`You do not have a User Profile saved yet. Please enter at least a user name on the page that followes.`);
        app.goToPage(PageNames.settings)
    }
    else {
        gs.docsFolder = "/"+gs.userName || ''; 
        gd({ type: 'docsGoHome', payload: gs });
    }
}