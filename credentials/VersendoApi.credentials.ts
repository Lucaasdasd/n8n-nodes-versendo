import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class VersendoApi implements ICredentialType {
	name = 'versendoApi';

	displayName = 'Versendo API';

	icon: Icon = { light: 'file:versendo.svg', dark: 'file:versendo.dark.svg' };

	documentationUrl =
		'https://github.com/Lucaasdasd/n8n-nodes-versendo?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Starts with vs_test_ (test mode: nothing is printed or charged) or vs_live_ (letters are paid from your Versendo balance and really sent). Get a test key at https://versendo.de/entwickler.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://versendo.de',
			description: 'Leave as is. Only change it if Versendo support asks you to.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/v1/webhook',
			method: 'GET',
		},
	};
}
